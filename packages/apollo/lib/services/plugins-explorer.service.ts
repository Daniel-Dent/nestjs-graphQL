import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ModulesContainer } from '@nestjs/core/injector/modules-container';
import { GqlModuleOptions } from '@nestjs/graphql-experimental/interfaces/gql-module-options.interface';
import { BaseExplorerService } from '@nestjs/graphql-experimental/services/base-explorer.service';
import { PLUGIN_METADATA } from '../apollo.constants';

export class PluginsExplorerService extends BaseExplorerService {
  constructor(private readonly modulesContainer: ModulesContainer) {
    super();
  }

  explore(options: GqlModuleOptions) {
    const modules = this.getModules(
      this.modulesContainer,
      options.include || [],
    );
    return this.flatMap(modules, (instance) => this.filterPlugins(instance));
  }

  filterPlugins<T = any>(wrapper: InstanceWrapper<T>) {
    const { instance } = wrapper;
    if (!instance) {
      return undefined;
    }
    const metadata = Reflect.getMetadata(PLUGIN_METADATA, instance.constructor);
    return metadata ? instance : undefined;
  }
}
