import { WORKSPACE_NAME_MAX_LENGTH, normalizeWorkspaceName } from '@teamwork/validation';

export interface CreateWorkspaceFormValues {
  name: string;
}

export interface CreateWorkspaceValidationResult {
  input: { name: string } | null;
  errors: Partial<Record<'name' | 'form', string>>;
}

export function validateCreateWorkspaceInput(
  values: CreateWorkspaceFormValues,
): CreateWorkspaceValidationResult {
  const name = normalizeWorkspaceName(values.name);
  const errors: CreateWorkspaceValidationResult['errors'] = {};

  if (!name) {
    errors.name = 'Workspace name is required.';
  } else if (name.length < 2 || name.length > WORKSPACE_NAME_MAX_LENGTH) {
    errors.name = `Workspace name must be 2-${String(WORKSPACE_NAME_MAX_LENGTH)} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return {
      input: null,
      errors,
    };
  }

  return {
    input: { name },
    errors: {},
  };
}
