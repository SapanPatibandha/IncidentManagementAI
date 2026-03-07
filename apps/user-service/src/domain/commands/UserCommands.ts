import { DomainCommand } from './BaseCommand';

export class RegisterUser extends DomainCommand {
  constructor(
    aggregateId: string,
    payload: {
      email: string;
      role: 'Incident Creator' | 'Issue Responder' | 'Administrator';
    }
  ) {
    super(aggregateId, payload);
  }
}

export class UpdateUserProfile extends DomainCommand {
  constructor(
    aggregateId: string,
    payload: {
      name?: string;
      email?: string;
    }
  ) {
    super(aggregateId, payload);
  }
}