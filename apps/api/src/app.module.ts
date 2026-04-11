import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from './common/auth/workspace-member.guard';
import { WorkspacePolicyModule } from './common/policy/workspace-policy.module';
import { WorkspaceRoleGuard } from './common/auth/workspace-role.guard';
import { SecurityTelemetryModule } from './common/security/security-telemetry.module';
import { validateEnvironment } from './config/env.validation';
import { MembershipsModule } from './memberships/memberships.module';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { WorkspaceInvitationsModule } from './workspace-invitations/workspace-invitations.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttl = configService.getOrThrow<number>('THROTTLE_TTL_MS');
        const limit = configService.getOrThrow<number>('THROTTLE_LIMIT');

        return [
          {
            ttl,
            limit,
          },
        ];
      },
    }),
    WorkspacePolicyModule,
    SecurityTelemetryModule,
    PrismaModule,
    UsersModule,
    MembershipsModule,
    TasksModule,
    WorkspaceInvitationsModule,
    WorkspacesModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtAuthGuard,
    WorkspaceMemberGuard,
    WorkspaceRoleGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
