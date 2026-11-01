import { Module } from '@nestjs/common';
import { InstallationController } from './installation.controller.js';
import { InstallationService } from './installation.service.js';

@Module({ controllers: [InstallationController], providers: [InstallationService] })
export class InstallationModule {}
