import { Module } from '@nestjs/common';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { EmployeesController } from './employees.controller';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';
import { InMemoryEmployeesRepository } from './in-memory-employees.repository';

@Module({
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    {
      // FAKE_DB=true swaps the Oracle repository for an in-memory stub (dev/demo only).
      provide: EmployeesRepository,
      useFactory: (tenants: TenantConnectionService) =>
        process.env.FAKE_DB === 'true'
          ? (new InMemoryEmployeesRepository() as unknown as EmployeesRepository)
          : new EmployeesRepository(tenants),
      inject: [TenantConnectionService],
    },
  ],
})
export class EmployeesModule {}
