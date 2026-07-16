import { conflict, notFound } from '../../shared/errors/http-error';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { toPositionPayload } from './position-field.map';

export class InMemoryPositionsRepository {
  private readonly store = new Map<string, Record<string, unknown>>();

  private key(country: string, companyId: string, id: string) {
    return `${country}:${companyId}:${id}`;
  }

  async create(country: string, dto: CreatePositionDto) {
    const k = this.key(country, dto.companyId, dto.id);
    if (this.store.has(k)) throw conflict('Position already exists');
    this.store.set(k, toPositionPayload(dto));
    return { companyId: dto.companyId, id: dto.id, message: 'OK' };
  }

  async findById(country: string, companyId: string, id: string) {
    const item = this.store.get(this.key(country, companyId, id));
    if (!item) throw notFound(`Position ${companyId}/${id} not found`);
    return item;
  }

  async findAll(
    country: string,
    page: number,
    size: number,
    companyId?: string,
  ) {
    const prefix = `${country}:`;
    const items = [...this.store.entries()]
      .filter(([k]) => {
        if (!k.startsWith(prefix)) return false;
        if (companyId === undefined) return true;
        return k.startsWith(`${country}:${companyId}:`);
      })
      .map(([, v]) => v);
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }

  async update(country: string, dto: UpdatePositionDto) {
    const existing = await this.findById(country, dto.companyId, dto.id);
    const merged = { ...existing, ...toPositionPayload(dto) };
    this.store.set(this.key(country, dto.companyId, dto.id), merged);
    return merged;
  }
}
