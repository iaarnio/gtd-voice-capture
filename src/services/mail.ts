import nodemailer from 'nodemailer';
import { logger } from '../logger';
import { getConfig } from '../config';

export interface MailMetadata {
  detectedLanguage?: string;
  fileName?: string;
  fileSize?: number;
  transcriptionTime?: number;
  timestamp?: Date;
}

export class MailError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'MailError';
  }
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize mail transporter (called once at startup)
 */
export function initializeMailer(): void {
  const config = getConfig();

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465, // Use TLS for 465, STARTTLS for 587
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  logger.info(
    {
      component: 'mail',
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
    },
    'Mail transporter initialized'
  );
}

/**
 * Send transcription email
 * @param text - Transcribed text
 * @param metadata - Additional metadata (language, file info, etc.)
 * @param requestId - Request ID for correlation
 * @throws MailError on failure
 */
export async function sendMail(
  text: string,
  metadata: MailMetadata,
  requestId: string
): Promise<void> {
  if (!transporter) {
    throw new MailError('MAIL_NOT_INITIALIZED', 'Mail transporter not initialized');
  }

  const config = getConfig();
  const requestLog = logger.child({ requestId });
  const startTime = Date.now();

  const subject = '[GTD][VOICE] Transcribed Audio';
  const timestamp = metadata.timestamp || new Date();
  const language = metadata.detectedLanguage || 'auto-detected';

  const body = `${text}

---
Captured at: ${timestamp.toISOString()}
Language: ${language}${metadata.fileName ? `\nFilename: ${metadata.fileName}` : ''}`;

  try {
    requestLog.debug(
      {
        component: 'mail',
        to: config.MAIL_TO,
        textLength: text.length,
      },
      'Sending email'
    );

    const info = await transporter.sendMail({
      from: config.MAIL_FROM,
      to: config.MAIL_TO,
      subject,
      text: body,
    });

    const duration = Date.now() - startTime;

    requestLog.info(
      {
        component: 'mail',
        duration,
        messageId: info.messageId,
        response: info.response,
      },
      'Email sent successfully'
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle SMTP errors
    if (error instanceof Error) {
      // Check for common SMTP errors
      if (error.message.includes('ECONNREFUSED')) {
        requestLog.error(
          {
            component: 'mail',
            error: error.message,
            code: 'MAIL_SMTP_CONNECTION_FAILED',
            duration,
          },
          'SMTP connection failed'
        );
        throw new MailError(
          'MAIL_SMTP_CONNECTION_FAILED',
          'Failed to connect to SMTP server',
          error
        );
      }

      if (error.message.includes('Invalid login')) {
        requestLog.error(
          {
            component: 'mail',
            error: error.message,
            code: 'MAIL_AUTH_FAILED',
            duration,
          },
          'SMTP authentication failed'
        );
        throw new MailError(
          'MAIL_AUTH_FAILED',
          'SMTP authentication failed',
          error
        );
      }

      if (error.message.includes('Timeout')) {
        requestLog.error(
          {
            component: 'mail',
            error: error.message,
            code: 'MAIL_TIMEOUT',
            duration,
          },
          'SMTP request timeout'
        );
        throw new MailError(
          'MAIL_TIMEOUT',
          'SMTP request timed out',
          error
        );
      }

      requestLog.error(
        {
          component: 'mail',
          error: error.message,
          code: 'MAIL_SEND_FAILED',
          duration,
        },
        'Failed to send email'
      );
      throw new MailError(
        'MAIL_SEND_FAILED',
        `Failed to send email: ${error.message}`,
        error
      );
    }

    // Unknown error
    requestLog.error(
      {
        component: 'mail',
        code: 'MAIL_UNKNOWN_ERROR',
        duration,
      },
      'Unknown error sending email'
    );
    throw new MailError('MAIL_UNKNOWN_ERROR', 'Unknown error sending email');
  }
}
