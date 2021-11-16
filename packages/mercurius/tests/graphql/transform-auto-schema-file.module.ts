import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql-experimental';
import { GraphQLSchema, lexicographicSortSchema } from 'graphql';
import { MercuriusDriver } from '../../lib/drivers';
import { DirectionsModule } from '../code-first/directions/directions.module';
import { RecipesModule } from '../code-first/recipes/recipes.module';

@Module({
  imports: [
    RecipesModule,
    DirectionsModule,
    GraphQLModule.forRoot({
      driver: MercuriusDriver,
      autoSchemaFile: 'schema.graphql',
      transformSchema: (schema: GraphQLSchema) =>
        lexicographicSortSchema(schema),
      transformAutoSchemaFile: true,
    }),
  ],
})
export class TransformAutoSchemaFileModule {}
