import { SetMetadata } from '@nestjs/common';

export const SKIP_PASSWORD_CHANGE_KEY = 'skipPasswordChange';
export const SkipPasswordChange = () => SetMetadata(SKIP_PASSWORD_CHANGE_KEY, true);
