import { DMMF } from '@prisma/generator-helper';

// Extend DMMF Model to include schema property
declare module '@prisma/generator-helper' {
  namespace DMMF {
    interface Model {
      schema?: string;
    }
  }
}

export const getModelByType = (
  models: DMMF.Model[],
  type: string,
): DMMF.Model | undefined => {
  return models.find((model) => model.name === type);
};
