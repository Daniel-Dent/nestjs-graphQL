import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql-experimental';
import { join } from 'path';
import { ApolloAdapterOptions } from '../../lib';
import { ApolloGraphQLAdapter } from '../../lib/adapters';
import { CatsModule } from './cats/cats.module';

@Module({
  imports: [
    CatsModule,
    GraphQLModule.forRoot<ApolloAdapterOptions>({
      adapter: ApolloGraphQLAdapter,
      typePaths: [join(__dirname, '**', '*.graphql')],
    }),
  ],
})
export class ApplicationModule {}
