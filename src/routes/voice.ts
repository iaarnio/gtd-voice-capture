import { Router, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { createRequestLogger } from '../logger';
import { authMiddleware } from '../middleware/auth';
import { transcribeAudio, WhisperError } from '../services/whisper';
import { sendMail, MailError } from '../services/mail';
import {
  recordRequestSuccess,
  recordRequestError,
  recordValidationFailure,
  recordMailError,
  recordWhisperError,
} from '../metrics';

const router = Router();

// Multer configuration for audio files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Validate audio file types
    const allowedMimes = [
      'audio/mpeg', // .mp3
      'audio/mp3', // .mp3 (alternative)
      'audio/mp4', // .m4a
      'audio/wav', // .wav
      'audio/webm', // .webm
      'audio/ogg', // .ogg
      'audio/x-m4a', // .m4a (alternative)
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format: ${file.mimetype}`));
    }
  },
});

// POST /voice - Accept audio and return transcription
router.post('/', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  const requestLog = createRequestLogger((req.id as string) || 'unknown');
  const startTime = Date.now();

  requestLog.info(
    {
      component: 'http',
      method: 'POST',
      route: '/voice',
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    },
    'Request received'
  );

  // Validate file exists
  if (!req.file) {
    requestLog.warn(
      { component: 'http', reason: 'missing_file' },
      'Request rejected: no audio file'
    );
    recordValidationFailure('missing_file');
    return res.status(400).json({ ok: false, error: 'No audio file provided' });
  }

  // Additional validation: file size check
  if (req.file.size === 0) {
    requestLog.warn(
      { component: 'http', reason: 'empty_file' },
      'Request rejected: empty audio file'
    );
    recordValidationFailure('empty_file');
    return res.status(400).json({ ok: false, error: 'Audio file is empty' });
  }

  // Call Whisper to transcribe audio
  try {
    const result = await transcribeAudio(
      req.file.buffer,
      req.file.originalname,
      (req.id as string) || 'unknown'
    );

    // Transcription successful, now send email
    try {
      await sendMail(
        result.text,
        {
          detectedLanguage: result.language,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          timestamp: new Date(),
          audioBuffer: req.file.buffer,
          audioMimeType: req.file.mimetype,
        },
        (req.id as string) || 'unknown'
      );

      const duration = Date.now() - startTime;

      requestLog.info(
        {
          component: 'http',
          statusCode: 200,
          duration,
          textLength: result.text.length,
          emailSent: true,
        },
        'Request completed'
      );

      // Record success metric
      recordRequestSuccess(duration, result.language);

      res.json({
        ok: true,
        text: result.text,
        language: result.language || 'unknown',
      });
    } catch (mailError) {
      const duration = Date.now() - startTime;

      if (mailError instanceof MailError) {
        requestLog.error(
          {
            component: 'mail',
            error: mailError.code,
            message: mailError.message,
            duration,
          },
          'Email sending failed'
        );
        recordMailError(mailError.code, duration);
        return res.status(500).json({
          ok: false,
          error: 'Failed to send email',
        });
      }

      // Unexpected error from mail service
      requestLog.error(
        {
          component: 'mail',
          error: mailError instanceof Error ? mailError.message : 'unknown',
        },
        'Unexpected error sending email'
      );
      res.status(500).json({
        ok: false,
        error: 'Internal server error',
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof WhisperError) {
      requestLog.error(
        {
          component: 'whisper',
          error: error.code,
          message: error.message,
          duration,
        },
        'Whisper transcription failed'
      );
      recordWhisperError(error.code, duration);
      return res.status(500).json({
        ok: false,
        error: 'Failed to transcribe audio',
      });
    }

    // Unexpected error
    requestLog.error(
      { component: 'http', error: error instanceof Error ? error.message : 'unknown' },
      'Unexpected error in voice handler'
    );
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

export default router;
