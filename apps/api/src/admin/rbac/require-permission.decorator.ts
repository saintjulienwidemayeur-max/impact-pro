import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION = 'admin:required-permission';

/** Stand-in (billing agent): replaced by the admin core agent's version at merge. */
export const RequirePermission = (permission: string) => SetMetadata(REQUIRED_PERMISSION, permission);
