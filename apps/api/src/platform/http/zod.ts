import { Body, Param, Query, type PipeTransform } from '@nestjs/common';
import { ApiBody, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { DomainError } from '../errors.js';

type JsonSchemaObject = Record<string, unknown>;

/** Converts a Zod schema to an OpenAPI 3.0 compatible JSON schema for Swagger. */
export function toOpenApiSchema(
  schema: z.ZodType,
  io: 'input' | 'output' = 'output',
): JsonSchemaObject {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io, unrepresentable: 'any' });
}

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Request validation failed',
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}

type ParamDecoratorTarget = object;

function describeMethod(
  target: ParamDecoratorTarget,
  key: string | symbol | undefined,
  decorator: MethodDecorator,
): void {
  if (key === undefined) return;
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor) decorator(target, key, descriptor);
}

/** Validates the request body with a Zod schema and documents it in OpenAPI. */
export function ZodBody(schema: z.ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key, index);
    describeMethod(target, key, ApiBody({ schema: toOpenApiSchema(schema, 'input') }));
  };
}

/** Validates the query string with a Zod object schema and documents each parameter. */
export function ZodQuery(schema: z.ZodObject): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodValidationPipe(schema))(target, key, index);
    for (const [name, field] of Object.entries(schema.shape)) {
      describeMethod(
        target,
        key,
        ApiQuery({
          name,
          required: !(field as z.ZodType).safeParse(undefined).success,
          schema: toOpenApiSchema(field as z.ZodType, 'input'),
        }),
      );
    }
  };
}

/** Validates path parameters with a Zod object schema and documents each parameter. */
export function ZodParams(schema: z.ZodObject): ParameterDecorator {
  return (target, key, index) => {
    Param(new ZodValidationPipe(schema))(target, key, index);
    for (const [name, field] of Object.entries(schema.shape)) {
      describeMethod(
        target,
        key,
        ApiParam({ name, required: true, schema: toOpenApiSchema(field as z.ZodType, 'input') }),
      );
    }
  };
}

/** Documents a response body with a Zod schema. */
export function ZodResponse(status: number, schema: z.ZodType, description = ''): MethodDecorator {
  return ApiResponse({ status, description, schema: toOpenApiSchema(schema) });
}
