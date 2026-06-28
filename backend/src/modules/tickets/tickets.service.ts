import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { createEntityId } from '@/common/ids/entity-id.util';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async create(createTicketDto: CreateTicketDto, username: string): Promise<Ticket> {
    const ticket = this.ticketRepository.create({
      ...createTicketDto,
      _id: createEntityId('TICKET'),
      requester_username: username,
      source: 'PORTAL',
    });
    return this.ticketRepository.save(ticket);
  }

  async findAllByRequester(username: string): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { requester_username: username },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { _id: id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }
}
