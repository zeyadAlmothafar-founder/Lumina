import { createContext, useContext } from 'react';

// 'api'   → Google AI Studio (cloud)
// 'local' → Ollama (local device)
export const InferenceContext = createContext('api');

export function useInference() {
  return useContext(InferenceContext);
}

// Convenience: returns fetch headers pre-loaded with the inference mode
export function useInferenceHeaders() {
  const mode = useInference();
  return { 'X-Inference-Mode': mode };
}
