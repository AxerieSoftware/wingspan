import {
	buildClientSchema,
	type ExecutionResult,
	type GraphQLFieldResolver,
	type GraphQLOutputType,
	type GraphQLSchema,
	type GraphQLTypeResolver,
	graphql,
	type IntrospectionQuery,
	isAbstractType,
	isEnumType,
	isListType,
	isNonNullType,
	isObjectType
} from 'graphql';

export type RootResolver = (args: Record<string, unknown>) => unknown;

const NON_NULL_SCALAR_DEFAULTS: Record<string, unknown> = { ID: '0', String: '', Int: 0, Float: 0, Boolean: false, Date: '2026-01-01', DateTime: '2026-01-01T00:00:00Z', JSON: {}, JSONString: '{}' };

/**
 * Runs requests against Monarch's own schema. Root fields with a resolver come from the household; every other field
 * gets an empty value of its real type, so Monarch's app always gets well-formed data.
 */
export class GraphqlMock {
	private readonly schema: GraphQLSchema;
	private readonly roots: Record<string, RootResolver>;

	public constructor(introspection: IntrospectionQuery, roots: Record<string, RootResolver>) {
		this.schema = buildClientSchema(introspection);
		this.roots = roots;
	}

	public respond(query: string, operationName: string | undefined, variables: Record<string, unknown>): Promise<ExecutionResult> {
		return Promise.resolve(graphql({ schema: this.schema, source: query, operationName, variableValues: variables, fieldResolver: this.resolveField, typeResolver: this.resolveType }));
	}

	private readonly resolveField: GraphQLFieldResolver<unknown, unknown> = (source, args, _context, info) => {
		const isRoot = info.parentType === this.schema.getQueryType() || info.parentType === this.schema.getMutationType();
		if (isRoot) {
			const root = this.roots[info.fieldName];
			return root ? root(args) : this.emptyValue(info.returnType);
		}
		const value = (source as Record<string, unknown> | null)?.[info.path.key as string] ?? (source as Record<string, unknown> | null)?.[info.fieldName];
		return value !== undefined ? value : this.emptyValue(info.returnType);
	};

	private readonly resolveType: GraphQLTypeResolver<unknown, unknown> = (value, _context, _info, abstractType) =>
		(value as { __typename?: string } | null)?.__typename ?? this.schema.getPossibleTypes(abstractType)[0]?.name;

	private emptyValue(type: GraphQLOutputType): unknown {
		const isRequired = isNonNullType(type);
		const namedType = isNonNullType(type) ? type.ofType : type;
		if (isListType(namedType)) return [];
		if (isObjectType(namedType) || isAbstractType(namedType)) return {};
		if (!isRequired) return null;
		if (isEnumType(namedType)) return namedType.getValues()[0]?.value;
		return NON_NULL_SCALAR_DEFAULTS[namedType.name] ?? '';
	}
}
