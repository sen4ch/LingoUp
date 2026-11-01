import { Controller, Get, HttpCode, Post, Put, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { detectHardware } from './hardware.js';
import {
  InstallationSettingsSchema,
  type InstallationSettings,
} from '../../config/installation.js';
import { Public, ZodBody } from '../../platform/index.js';
import {
  InstallationService,
  INSTALLATION_COOKIE,
  INSTALLATION_SESSION_SECONDS,
} from './installation.service.js';

const PasswordSchema = z.object({ password: z.string().min(12).max(128) });

// This separate installation login never grants access to learners' accounts or data.
@Public()
@Controller('v1/setup')
export class InstallationController {
  constructor(private readonly installation: InstallationService) {}
  private cookie(request: FastifyRequest) {
    return request.cookies[INSTALLATION_COOKIE];
  }
  private setCookie(reply: FastifyReply, request: FastifyRequest, token: string) {
    reply.setCookie(INSTALLATION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: this.installation.secureCookie || request.protocol === 'https',
      maxAge: INSTALLATION_SESSION_SECONDS,
    });
  }

  @Get('status')
  status(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    reply.header('cache-control', 'no-store');
    return this.installation.status(this.cookie(request));
  }

  @Post('owner')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async claim(
    @ZodBody(PasswordSchema) body: { password: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.setCookie(reply, request, await this.installation.claim(body.password));
    return { ok: true };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @ZodBody(PasswordSchema) body: { password: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.setCookie(reply, request, await this.installation.login(body.password));
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    this.installation.logout(this.cookie(request));
    reply.clearCookie(INSTALLATION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('settings')
  settings(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    this.installation.requireOwner(this.cookie(request));
    reply.header('cache-control', 'no-store');
    return this.installation.settings();
  }

  @Get('hardware')
  hardware(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    this.installation.requireOwner(this.cookie(request));
    reply.header('cache-control', 'no-store');
    return detectHardware(this.installation.storageDirectory);
  }

  @Put('settings')
  save(
    @Req() request: FastifyRequest,
    @ZodBody(InstallationSettingsSchema) settings: InstallationSettings,
  ) {
    this.installation.requireOwner(this.cookie(request));
    return this.installation.save(settings);
  }

  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  test(
    @Req() request: FastifyRequest,
    @ZodBody(InstallationSettingsSchema) settings: InstallationSettings,
  ) {
    this.installation.requireOwner(this.cookie(request));
    return this.installation.test(settings);
  }

  @Post('pull')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  pull(
    @Req() request: FastifyRequest,
    @ZodBody(InstallationSettingsSchema) settings: InstallationSettings,
  ) {
    this.installation.requireOwner(this.cookie(request));
    return this.installation.startPull(settings);
  }

  @Get('pull')
  progress(@Req() request: FastifyRequest) {
    this.installation.requireOwner(this.cookie(request));
    return this.installation.pullStatus();
  }

  @Post('voice-preview')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async preview(
    @Req() request: FastifyRequest,
    @ZodBody(z.object({ speech: z.enum(['edge', 'piper-medium', 'piper-high']) }))
    body: { speech: 'edge' | 'piper-medium' | 'piper-high' },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.installation.requireOwner(this.cookie(request));
    const audio = await this.installation.previewVoice(body.speech);
    reply.header('content-type', 'audio/mpeg').header('cache-control', 'no-store');
    return audio;
  }
}
