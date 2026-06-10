import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getMessaging, Messaging, BatchResponse } from 'firebase-admin/messaging';

export interface FcmMessage {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private messaging: Messaging | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured — push notifications disabled');
      return;
    }

    try {
      const apps = getApps();
      if (apps.length === 0) {
        this.app = initializeApp({
          credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
        });
      } else {
        this.app = apps[0]!;
      }
      this.messaging = getMessaging(this.app);
      this.logger.log('Firebase Admin SDK initialised');
    } catch (err) {
      this.logger.error('Firebase initialisation failed', err);
    }
  }

  get isReady(): boolean {
    return this.messaging !== null;
  }

  async sendToToken(fcmToken: string, message: FcmMessage): Promise<string | null> {
    if (!this.isReady) return null;
    try {
      return await this.messaging!.send({
        token: fcmToken,
        notification: { title: message.title, body: message.body, imageUrl: message.imageUrl },
        data: message.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (err) {
      this.logger.error(`FCM send failed for token ${fcmToken.slice(0, 10)}…`, err);
      return null;
    }
  }

  async sendToMultipleTokens(fcmTokens: string[], message: FcmMessage): Promise<BatchResponse | null> {
    if (!this.isReady || fcmTokens.length === 0) return null;
    try {
      return await this.messaging!.sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title: message.title, body: message.body, imageUrl: message.imageUrl },
        data: message.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (err) {
      this.logger.error('FCM multicast failed', err);
      return null;
    }
  }

  async sendToTopic(topic: string, message: FcmMessage): Promise<string | null> {
    if (!this.isReady) return null;
    try {
      return await this.messaging!.send({
        topic,
        notification: { title: message.title, body: message.body },
        data: message.data ?? {},
      });
    } catch (err) {
      this.logger.error(`FCM topic send failed for topic ${topic}`, err);
      return null;
    }
  }

  async subscribeToTopic(fcmTokens: string[], topic: string): Promise<void> {
    if (!this.isReady) return;
    try {
      await this.messaging!.subscribeToTopic(fcmTokens, topic);
    } catch (err) {
      this.logger.error(`FCM topic subscription failed for topic ${topic}`, err);
    }
  }
}
