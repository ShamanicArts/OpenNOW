/**
 * Flexible shader parameter system
 * Phase 2: Shader Modularization - Dynamic Parameters
 *
 * No more hardcoded intensity/speed/param1/param2.
 * Each shader defines its own parameters with meaningful names.
 */

export interface ShaderParam {
  /** Display name in UI */
  name: string;
  /** GLSL uniform name */
  uniform: string;
  /** Data type */
  type: 'float' | 'int' | 'bool' | 'color';
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Default value */
  default: number;
  /** Step increment for UI */
  step: number;
  /** Optional unit suffix for display */
  unit?: string;
}

export interface ShaderDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description for tooltip */
  description?: string;
  /** Category for grouping */
  category: 'color' | 'distortion' | 'feedback' | 'blend' | 'glitch';
  /** Parameters this shader accepts */
  parameters: ShaderParam[];
  /** Optional per-shader helper functions/constants inserted before main() */
  fragmentPreamble?: string;
  /** GLSL function body - content of main() */
  fragmentBody: string;
  /** Whether this shader uses the feedback texture */
  usesFeedback?: boolean;
  /** Whether this shader is audio-reactive by default */
  audioReactive?: boolean;
}

/** Runtime shader instance with current parameter values */
export interface ShaderInstance {
  definition: ShaderDefinition;
  /** Current parameter values by uniform name */
  values: Record<string, number>;
}

/** Validation result for shader parameter values */
export interface ParamValidationResult {
  valid: boolean;
  errors: string[];
  /** Values that failed validation, with defaults substituted */
  correctedValues?: Record<string, number>;
}

/**
 * Validate parameter values against a shader definition.
 * Fails loudly - returns errors for invalid/missing values.
 */
export function validateShaderParams(
  definition: ShaderDefinition,
  values: Record<string, number>
): ParamValidationResult {
  const errors: string[] = [];
  const correctedValues: Record<string, number> = {};

  for (const param of definition.parameters) {
    const value = values[param.uniform];

    if (value === undefined || value === null) {
      errors.push(`Missing required parameter: ${param.uniform} (${param.name})`);
      correctedValues[param.uniform] = param.default;
      continue;
    }

    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(`Invalid type for ${param.uniform}: expected number, got ${typeof value}`);
      correctedValues[param.uniform] = param.default;
      continue;
    }

    if (value < param.min || value > param.max) {
      errors.push(
        `Value out of range for ${param.uniform}: ${value} (must be ${param.min}-${param.max})`
      );
      // Clamp to valid range
      correctedValues[param.uniform] = Math.max(param.min, Math.min(param.max, value));
      continue;
    }

    correctedValues[param.uniform] = value;
  }

  // Check for extra parameters that shouldn't exist
  const validUniforms = new Set(definition.parameters.map((p) => p.uniform));
  for (const key of Object.keys(values)) {
    if (!validUniforms.has(key)) {
      errors.push(`Unknown parameter for shader ${definition.id}: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    correctedValues,
  };
}

/**
 * Create default values for a shader definition.
 */
export function createDefaultValues(definition: ShaderDefinition): Record<string, number> {
  const values: Record<string, number> = {};
  for (const param of definition.parameters) {
    values[param.uniform] = param.default;
  }
  return values;
}
