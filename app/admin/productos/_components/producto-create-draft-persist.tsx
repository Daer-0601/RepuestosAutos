"use client";

import { useEffect } from "react";

type DraftValueMap = Record<string, string>;

const FIELD_SELECTOR = "input[name], textarea[name], select[name]";

function isUnsupportedInput(el: Element): boolean {
  return el instanceof HTMLInputElement && (el.type === "file" || el.type === "password");
}

export function ProductoCreateDraftPersist({
  formId,
  storageKey,
  enabled,
}: {
  formId: string;
  storageKey: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const restoreDraft = () => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      let data: DraftValueMap;
      try {
        data = JSON.parse(raw) as DraftValueMap;
      } catch {
        return;
      }

      const fields = form.querySelectorAll(FIELD_SELECTOR);
      fields.forEach((field) => {
        if (isUnsupportedInput(field)) return;
        const name = field.getAttribute("name");
        if (!name || !(name in data)) return;
        const value = data[name] ?? "";

        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          field.value = value;
          return;
        }
        if (field instanceof HTMLSelectElement) {
          field.value = value;
        }
      });
    };

    const saveDraft = () => {
      const fields = form.querySelectorAll(FIELD_SELECTOR);
      const next: DraftValueMap = {};

      fields.forEach((field) => {
        if (isUnsupportedInput(field)) return;
        const name = field.getAttribute("name");
        if (!name) return;

        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          next[name] = field.value ?? "";
          return;
        }
        if (field instanceof HTMLSelectElement) {
          next[name] = field.value ?? "";
        }
      });

      localStorage.setItem(storageKey, JSON.stringify(next));
    };
    const clearOnSubmit = () => {
      localStorage.removeItem(storageKey);
    };

    restoreDraft();
    form.addEventListener("input", saveDraft);
    form.addEventListener("change", saveDraft);
    form.addEventListener("submit", clearOnSubmit);

    const clearButtons = document.querySelectorAll<HTMLButtonElement>(
      `button[data-clear-producto-draft="${formId}"]`,
    );
    const clearDraft = () => {
      localStorage.removeItem(storageKey);
      form.reset();
    };
    clearButtons.forEach((btn) => btn.addEventListener("click", clearDraft));

    return () => {
      form.removeEventListener("input", saveDraft);
      form.removeEventListener("change", saveDraft);
      form.removeEventListener("submit", clearOnSubmit);
      clearButtons.forEach((btn) => btn.removeEventListener("click", clearDraft));
    };
  }, [enabled, formId, storageKey]);

  return null;
}
