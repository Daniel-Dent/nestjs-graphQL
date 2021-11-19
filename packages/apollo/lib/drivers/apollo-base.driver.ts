import { HttpStatus } from '@nestjs/common';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { AbstractGraphQLDriver } from '@nestjs/graphql-experimental/drivers/abstract-graphql.driver';
import {
  ApolloError,
  ApolloServerBase,
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
  AuthenticationError,
  ForbiddenError,
  PluginDefinition,
  UserInputError,
} from 'apollo-server-core';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import * as omit from 'lodash.omit';
import { ApolloDriverConfig } from '../interfaces';

const apolloPredefinedExceptions: Partial<
  Record<HttpStatus, typeof ApolloError | typeof UserInputError>
> = {
  [HttpStatus.BAD_REQUEST]: UserInputError,
  [HttpStatus.UNAUTHORIZED]: AuthenticationError,
  [HttpStatus.FORBIDDEN]: ForbiddenError,
};

export abstract class ApolloBaseDriver<
  T extends Record<string, any> = ApolloDriverConfig,
> extends AbstractGraphQLDriver<ApolloServerBase, T> {
  protected _apolloServer: ApolloServerBase;

  get instance(): ApolloServerBase {
    return this._apolloServer;
  }

  public async start(apolloOptions: T) {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const platformName = httpAdapter.getType();

    if (platformName === 'express') {
      await this.registerExpress(apolloOptions);
    } else if (platformName === 'fastify') {
      await this.registerFastify(apolloOptions);
    } else {
      throw new Error(`No support for current HttpAdapter: ${platformName}`);
    }
  }

  public stop() {
    return this._apolloServer?.stop();
  }

  public async mergeDefaultOptions(options: T): Promise<T> {
    let defaults: ApolloDriverConfig = {
      path: '/graphql',
      fieldResolverEnhancers: [],
      stopOnTerminationSignals: false,
    };

    if (
      (options.playground === undefined &&
        process.env.NODE_ENV !== 'production') ||
      options.playground
    ) {
      const playgroundOptions =
        typeof options.playground === 'object' ? options.playground : undefined;
      defaults = {
        ...defaults,
        plugins: [
          ApolloServerPluginLandingPageGraphQLPlayground(
            playgroundOptions,
          ) as PluginDefinition,
        ],
      };
    } else if (
      (options.playground === undefined &&
        process.env.NODE_ENV === 'production') ||
      options.playground === false
    ) {
      defaults = {
        ...defaults,
        plugins: [ApolloServerPluginLandingPageDisabled() as PluginDefinition],
      };
    }

    options = await super.mergeDefaultOptions(
      options,
      omit(defaults, 'plugins'),
    );

    (options as ApolloDriverConfig).plugins = (options.plugins || []).concat(
      defaults.plugins || [],
    );

    this.wrapFormatErrorFn(options);
    return options;
  }

  protected async registerExpress(
    apolloOptions: T,
    { preStartHook }: { preStartHook?: () => void } = {},
  ) {
    const { ApolloServer } = loadPackage(
      'apollo-server-express',
      'GraphQLModule',
      () => require('apollo-server-express'),
    );
    const path = this.getNormalizedPath(apolloOptions);
    const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig } =
      apolloOptions;

    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    preStartHook?.();

    const apolloServer = new ApolloServer(apolloOptions as any);
    await apolloServer.start();

    apolloServer.applyMiddleware({
      app,
      path,
      disableHealthCheck,
      onHealthCheck,
      cors,
      bodyParserConfig,
    });

    this._apolloServer = apolloServer;
  }

  protected async registerFastify(
    apolloOptions: T,
    { preStartHook }: { preStartHook?: () => void } = {},
  ) {
    const { ApolloServer } = loadPackage(
      'apollo-server-fastify',
      'GraphQLModule',
      () => require('apollo-server-fastify'),
    );

    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();
    const path = this.getNormalizedPath(apolloOptions);

    preStartHook?.();

    const apolloServer = new ApolloServer(apolloOptions as any);
    await apolloServer.start();
    const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig } =
      apolloOptions;

    await app.register(
      apolloServer.createHandler({
        disableHealthCheck,
        onHealthCheck,
        cors,
        bodyParserConfig,
        path,
      }),
    );

    this._apolloServer = apolloServer;
  }

  private wrapFormatErrorFn(options: T) {
    if (options.autoTransformHttpErrors === false) {
      return;
    }
    if (options.formatError) {
      const origFormatError = options.formatError;
      const transformHttpErrorFn = this.createTransformHttpErrorFn();
      (options as ApolloDriverConfig).formatError = (err) => {
        err = transformHttpErrorFn(err) as GraphQLError;
        return origFormatError(err);
      };
    } else {
      (options as ApolloDriverConfig).formatError =
        this.createTransformHttpErrorFn();
    }
  }

  private createTransformHttpErrorFn() {
    return (originalError: any): GraphQLFormattedError => {
      const exceptionRef = originalError?.extensions?.exception;
      const isHttpException =
        exceptionRef?.response?.statusCode && exceptionRef?.status;

      if (!isHttpException) {
        return originalError as GraphQLFormattedError;
      }
      let error: ApolloError;

      const httpStatus = exceptionRef?.status;
      if (httpStatus in apolloPredefinedExceptions) {
        error = new apolloPredefinedExceptions[httpStatus](
          exceptionRef?.message,
        );
      } else {
        error = new ApolloError(exceptionRef.message, httpStatus?.toString());
      }

      error.stack = exceptionRef?.stacktrace;
      error.extensions['response'] = exceptionRef?.response;
      return error;
    };
  }
}
