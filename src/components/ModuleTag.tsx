import type { ModuleType } from '../types';
import { useLang, type TKey } from '../i18n';

const labelKeys: Record<ModuleType, TKey> = {
  campus: 'tag.campus',
  job: 'tag.job',
  fitness: 'tag.fitness',
  work: 'tag.work',
};

export default function ModuleTag({ module }: { module: ModuleType }) {
  const { t } = useLang();
  return (
    <span className={`module-tag ${module}`}>
      {t(labelKeys[module])}
    </span>
  );
}
