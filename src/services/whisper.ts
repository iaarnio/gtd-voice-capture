import OpenAI from 'openai';
import { Readable } from 'stream';
import { logger } from '../logger';
import { getConfig } from '../config';
import { TranscriptionResult } from '../types';

// Timeout for Whisper API call (in milliseconds)
const WHISPER_TIMEOUT = 30000; // 30 seconds

export class WhisperError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'WhisperError';
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 * @param fileBuffer - Audio file content as buffer
 * @param fileName - Original filename (for logging)
 * @param requestId - Request ID for correlation
 * @returns Transcription result with text and detected language
 * @throws WhisperError on failure
 */
export async function transcribeAudio(
  fileBuffer: Buffer,
  fileName: string,
  requestId: string
): Promise<TranscriptionResult> {
  const config = getConfig();
  const requestLog = logger.child({ requestId });
  const startTime = Date.now();

  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_BASE_URL,
    timeout: WHISPER_TIMEOUT,
  });

  try {
    requestLog.debug(
      {
        component: 'whisper',
        fileName,
        fileSize: fileBuffer.length,
      },
      'Calling Whisper API'
    );

    // Call Whisper without specifying language (auto-detect)
    // Whisper supports ~99 languages, including Finnish and English
    const response = await client.audio.transcriptions.create({
      file: new File([fileBuffer], fileName),
      model: 'whisper-1',
      // No language parameter = auto-detect
      // response_format: 'json' (default)
    });

    const duration = Date.now() - startTime;

    // OpenAI API returns language in verbose mode; basic mode doesn't include it
    // We'll try to extract it if available, otherwise return undefined
    const language = (response as unknown as Record<string, unknown>)?.language as string | undefined;

    requestLog.info(
      {
        component: 'whisper',
        duration,
        textLength: response.text.length,
        language: language || 'auto-detected',
      },
      'Whisper transcription successful'
    );

    return {
      text: response.text,
      language,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      requestLog.error(
        {
          component: 'whisper',
          error: error.message,
          duration,
          code: 'WHISPER_TIMEOUT',
        },
        'Whisper API timeout'
      );
      throw new WhisperError(
        'WHISPER_TIMEOUT',
        'Whisper API request timed out',
        error
      );
    }

    // Handle OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      requestLog.error(
        {
          component: 'whisper',
          error: error.message,
          status: error.status,
          code: error.code,
          duration,
        },
        'OpenAI API error'
      );

      if (error.status === 429) {
        throw new WhisperError(
          'WHISPER_RATE_LIMIT',
          'OpenAI API rate limit exceeded',
          error
        );
      }

      if (error.status === 401 || error.status === 403) {
        throw new WhisperError(
          'WHISPER_AUTH_ERROR',
          'OpenAI API authentication failed',
          error
        );
      }

      throw new WhisperError(
        'WHISPER_API_ERROR',
        `OpenAI API returned ${error.status}: ${error.message}`,
        error
      );
    }

    // Generic error
    if (error instanceof Error) {
      requestLog.error(
        {
          component: 'whisper',
          error: error.message,
          stack: error.stack,
          duration,
        },
        'Unexpected error during transcription'
      );
      throw new WhisperError(
        'WHISPER_UNKNOWN_ERROR',
        `Transcription failed: ${error.message}`,
        error
      );
    }

    // Unknown error
    requestLog.error(
      { component: 'whisper', duration },
      'Unknown error during transcription'
    );
    throw new WhisperError('WHISPER_UNKNOWN_ERROR', 'Transcription failed');
  }
}
