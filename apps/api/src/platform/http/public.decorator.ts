import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'lingoup:isPublic';

/** Marks a controller or route as accessible without a session. Everything else requires one. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
