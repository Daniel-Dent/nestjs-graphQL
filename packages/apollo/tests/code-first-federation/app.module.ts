import { Module } from '@nestjs/common';
import { GraphQLFederationModule } from '@nestjs/graphql-experimental';
import { ApolloFederationGraphQLAdapter } from '../../lib/adapters';
import { PostModule } from './post/post.module';
import { RecipeModule } from './recipe/recipe.module';
import { User } from './user/user.entity';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    UserModule,
    PostModule,
    RecipeModule,
    GraphQLFederationModule.forRoot({
      adapter: ApolloFederationGraphQLAdapter,
      debug: false,
      autoSchemaFile: true,
      buildSchemaOptions: {
        orphanedTypes: [User],
      },
    }),
  ],
})
export class ApplicationModule {}
