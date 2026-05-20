import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('global')
  globalSearch(
    @Query('q') query = '',
    @Query('limit') limit?: string,
  ) {
    return this.searchService.globalSearch(query, Number(limit || 20));
  }
}
