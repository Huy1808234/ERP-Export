import { Matches, ValidationOptions } from 'class-validator';

export const ENTITY_ID_REGEX = /^_[a-z][a-z0-9_]*_\d{8}_[a-z0-9]{8}$/;

export const IsEntityId = (validationOptions?: ValidationOptions) =>
  Matches(ENTITY_ID_REGEX, {
    message: '$property must be a valid technical _id',
    ...validationOptions,
  });
