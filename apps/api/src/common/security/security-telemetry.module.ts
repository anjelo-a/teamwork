import { Global, Module } from '@nestjs/common';
import { SecurityTelemetryService } from './security-telemetry.service';

@Global()
@Module({
  providers: [SecurityTelemetryService],
  exports: [SecurityTelemetryService],
})
export class SecurityTelemetryModule {}
