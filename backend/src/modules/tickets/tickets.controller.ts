import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../../auth/passport/jwt-auth.guard';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() createTicketDto: CreateTicketDto, @Request() req) {
    const username = req.user.username; // Assuming JwtAuthGuard provides username
    return this.ticketsService.create(createTicketDto, username);
  }

  @Get()
  findAllByRequester(@Request() req) {
    const username = req.user.username;
    return this.ticketsService.findAllByRequester(username);
  }
}
