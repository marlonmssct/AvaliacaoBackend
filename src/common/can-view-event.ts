import { EventStatus } from '@prisma/client';
import { Role } from './enums/role.enum';

export function canViewEvent(
  event: { status: EventStatus; organizerId: number },
  user?: { id: number; role: Role },
): boolean {
  return (
    event.status === EventStatus.PUBLISHED ||
    user?.role === Role.ADMIN ||
    event.organizerId === user?.id
  );
}
