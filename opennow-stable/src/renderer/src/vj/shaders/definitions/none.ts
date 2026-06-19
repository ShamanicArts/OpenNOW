import type { ShaderDefinition } from '../types.js';

export const shader_none: ShaderDefinition = {
  id: 'none',
  name: 'None',
  category: 'color',
  parameters: [],
  fragmentBody: `
    gl_FragColor = texture2D(map, vUv);
  
`,
};
