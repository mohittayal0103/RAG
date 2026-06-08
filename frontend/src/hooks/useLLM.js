import { useState, useEffect } from 'react';
import { getProviders } from '../api/llmApi';

const LS_KEY_PROVIDER = 'rag_selected_provider';
const LS_KEY_MODEL    = 'rag_selected_model';

/**
 * Loads the provider catalogue and manages the selected provider/model.
 * Selection is persisted to localStorage so it survives page reloads.
 */
export function useLLM() {
  const [providers, setProviders]     = useState([]);
  const [loadingLLM, setLoadingLLM]   = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(
    () => localStorage.getItem(LS_KEY_PROVIDER) || 'gemini'
  );
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem(LS_KEY_MODEL) || 'gemini-2.5-flash'
  );

  useEffect(() => {
    getProviders()
      .then((list) => {
        setProviders(list);

        // If the persisted selection is unavailable, fall back to the first available provider/model
        const available = list.filter((p) => p.available);
        if (available.length === 0) return;

        const currentProviderAvailable = available.some(
          (p) => p.id === selectedProvider && p.models.some((m) => m.id === selectedModel)
        );

        if (!currentProviderAvailable) {
          const fallbackProvider = available[0];
          const fallbackModel    = fallbackProvider.models.find((m) => m.default) || fallbackProvider.models[0];
          setSelectedProvider(fallbackProvider.id);
          setSelectedModel(fallbackModel.id);
          localStorage.setItem(LS_KEY_PROVIDER, fallbackProvider.id);
          localStorage.setItem(LS_KEY_MODEL, fallbackModel.id);
        }
      })
      .catch(() => {/* non-fatal — backend may be starting */})
      .finally(() => setLoadingLLM(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectModel(providerId, modelId) {
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
    localStorage.setItem(LS_KEY_PROVIDER, providerId);
    localStorage.setItem(LS_KEY_MODEL, modelId);
  }

  return { providers, loadingLLM, selectedProvider, selectedModel, selectModel };
}
