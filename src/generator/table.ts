import { DBMLKeywords, PrismaScalars } from './../keywords';
import { DMMF } from '@prisma/generator-helper';
import { getModelByType } from './model';

export function generateTables(
  models: DMMF.Model[],
  mapToDbSchema: boolean = false,
  includeRelationFields: boolean = true,
): string[] {
  // Group models by schema
  const modelsBySchema: { [schema: string]: DMMF.Model[] } = {};
  models.forEach((model) => {
    const schema = model.schema || 'public';
    if (!modelsBySchema[schema]) {
      modelsBySchema[schema] = [];
    }
    modelsBySchema[schema].push(model);
  });

  // Generate tables grouped by schema
  const result: string[] = [];
  Object.entries(modelsBySchema).forEach(([schema, schemaModels]) => {
    result.push(`// Schema: ${schema}`);
    schemaModels.forEach((model) => {
      result.push(generateTableDefinition(model, models, mapToDbSchema, includeRelationFields));
    });
  });

  return result;
}

function generateTableDefinition(
  model: DMMF.Model,
  models: DMMF.Model[],
  mapToDbSchema: boolean = false,
  includeRelationFields: boolean = true,
): string {
  let modelName = model.name;

  if (mapToDbSchema && model.dbName) {
    modelName = model.dbName;
  }

  // Add schema prefix if it exists
  const schemaPrefix = model.schema ? `${model.schema}.` : '';

  return (
    `${DBMLKeywords.Table} ${schemaPrefix}${modelName} {\n` +
    generateFields(
      model.fields,
      models,
      mapToDbSchema,
      includeRelationFields,
    ) +
    generateTableIndexes(model) +
    generateTableDocumentation(model) +
    '\n}'
  );
}

const generateTableIndexes = (model: DMMF.Model): string => {
  const primaryFields = model.primaryKey?.fields;
  const hasIdFields = primaryFields && primaryFields.length > 0;
  const hasCompositeUniqueIndex = hasCompositeUniqueIndices(model.uniqueFields);
  return hasIdFields || hasCompositeUniqueIndex
    ? `\n\n  ${DBMLKeywords.Indexes} {\n${generateTableBlockId(primaryFields)}${
        hasIdFields && hasCompositeUniqueIndex ? '\n' : ''
      }${generateTableCompositeUniqueIndex(model.uniqueFields)}\n  }`
    : '';
};

const hasCompositeUniqueIndices = (uniqueFields: string[][]): boolean => {
  return uniqueFields.filter((composite) => composite.length > 1).length > 0;
};

const generateTableBlockId = (primaryFields: string[] | undefined): string => {
  if (primaryFields === undefined || primaryFields.length === 0) {
    return '';
  }
  return `    (${primaryFields.join(', ')}) [${DBMLKeywords.Pk}]`;
};

const generateTableCompositeUniqueIndex = (
  uniqueFields: string[][],
): string => {
  return uniqueFields
    .filter((composite) => composite.length > 1)
    .map(
      (composite) => `    (${composite.join(', ')}) [${DBMLKeywords.Unique}]`,
    )
    .join('\n');
};

const generateTableDocumentation = (model: DMMF.Model): string => {
  const doc = model.documentation?.replace(/'/g, "\\'");
  return doc ? `\n\n  Note: '${doc}'` : '';
};

const generateFields = (
  fields: DMMF.Field[],
  models: DMMF.Model[],
  mapToDbSchema: boolean = false,
  includeRelationFields: boolean = true,
): string => {
  if (!includeRelationFields) {
    fields = fields.filter((field) => !field.relationName);
  }

  return fields
    .map((field) => {
      const relationToName = mapToDbSchema
        ? getModelByType(models, field.type)?.dbName || field.type
        : field.type;

      const fieldType =
        field.isList && !field.relationName
          ? `${relationToName}[]`
          : relationToName;

      return `  ${field.name} ${fieldType}${generateColumnDefinition(field)}`;
    })
    .join('\n');
};

const generateColumnDefinition = (field: DMMF.Field): string => {
  const columnDefinition: string[] = [];
  if (field.isId) {
    columnDefinition.push(DBMLKeywords.Pk);
  }

  if ((field.default as DMMF.FieldDefault)?.name === 'autoincrement') {
    columnDefinition.push(DBMLKeywords.Increment);
  }

  if ((field.default as DMMF.FieldDefault)?.name === 'now') {
    columnDefinition.push('default: `now()`');
  }

  if (field.isUnique) {
    columnDefinition.push(DBMLKeywords.Unique);
  }

  if (field.isRequired && !field.isId) {
    columnDefinition.push(DBMLKeywords.NotNull);
  }

  if (field.hasDefaultValue && typeof field.default != 'object') {
    if (
      field.type === PrismaScalars.String ||
      field.type === PrismaScalars.Json ||
      field.kind === 'enum'
    ) {
      columnDefinition.push(`${DBMLKeywords.Default}: '${field.default}'`);
    } else {
      columnDefinition.push(`${DBMLKeywords.Default}: ${field.default}`);
    }
  }

  if (field.documentation) {
    columnDefinition.push(
      `${DBMLKeywords.Note}: '${field.documentation.replace(/'/g, "\\'")}'`,
    );
  }

  if (columnDefinition.length) {
    return ' [' + columnDefinition.join(', ') + ']';
  }
  return '';
};
