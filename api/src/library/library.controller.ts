import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { BookDto, BorrowDto, ListBooksDto, ListLoansDto, ReturnDto } from './dto';
import { LibraryService } from './library.service';

@ApiTags('library')
@RequireFeature('LIBRARY')
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('summary') @RequirePermissions('LIBRARY_VIEW') summary() {
    return this.library.summary();
  }
  @Get('books') @RequirePermissions('LIBRARY_VIEW') books(@Query() q: ListBooksDto) {
    return this.library.books(q);
  }
  @Post('books') @RequirePermissions('LIBRARY_MANAGE') createBook(@Body() dto: BookDto) {
    return this.library.createBook(dto);
  }
  @Patch('books/:id') @RequirePermissions('LIBRARY_MANAGE') updateBook(
    @Param('id') id: string,
    @Body() dto: Partial<BookDto>,
  ) {
    return this.library.updateBook(id, dto);
  }
  @Delete('books/:id') @RequirePermissions('LIBRARY_MANAGE') deleteBook(@Param('id') id: string) {
    return this.library.deleteBook(id);
  }

  @Get('loans') @RequirePermissions('LIBRARY_VIEW') loans(@Query() q: ListLoansDto) {
    return this.library.loans(q);
  }
  @Post('loans') @RequirePermissions('LIBRARY_MANAGE') borrow(@Body() dto: BorrowDto) {
    return this.library.borrow(dto);
  }
  @Post('loans/:id/return') @RequirePermissions('LIBRARY_MANAGE') returnBook(
    @Param('id') id: string,
    @Body() dto: ReturnDto,
  ) {
    return this.library.returnBook(id, dto);
  }
  @Post('loans/:id/fine-paid') @RequirePermissions('LIBRARY_MANAGE') finePaid(@Param('id') id: string) {
    return this.library.markFinePaid(id);
  }
  @Get('students/:id') @RequirePermissions('LIBRARY_VIEW') forStudent(@Param('id') id: string) {
    return this.library.forStudent(id);
  }
}
