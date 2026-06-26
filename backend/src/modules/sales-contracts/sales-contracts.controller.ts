import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SalesContractsService } from './sales-contracts.service';
import {
  Public,
  ResponseMessage,
  User,
  RequirePermissions,
} from '@/decorator/customize';
import { SignSalesContractDto } from './dto/sign-sales-contract.dto';
import { RequestSignatureInvitationDto } from './dto/request-signature-invitation.dto';
import { VerifySignatureOtpDto } from './dto/verify-signature-otp.dto';
import { PortalSignSalesContractDto } from './dto/portal-sign-sales-contract.dto';
import { RequestContractCancelDto } from './dto/request-contract-cancel.dto';
import { RevokeSignatureInvitationDto } from './dto/revoke-signature-invitation.dto';
import { CreateSalesContractDto } from './dto/create-sales-contract.dto';
import { UpdateSalesContractDto } from './dto/update-sales-contract.dto';
import { CalculateSalesContractDto } from './dto/calculate-sales-contract.dto';

type RequestLike = {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type RequestUser = {
  username?: string;
};

type SalesContractListQuery = Record<
  string,
  string | number | boolean | undefined
>;

const getRequestMeta = (req: RequestLike) => {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor || req.ip || null;

  const userAgent = req.headers?.['user-agent'];

  return {
    ipAddress,
    userAgent: Array.isArray(userAgent)
      ? userAgent.join(' ')
      : userAgent || null,
  };
};

@Controller('sales-contracts')
export class SalesContractsController {
  constructor(private readonly salesContractsService: SalesContractsService) {}

  @Post()
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Create sales contract success')
  create(@Body() createDto: CreateSalesContractDto, @User() user: RequestUser) {
    return this.salesContractsService.create(createDto, user);
  }

  @Post('calculate')
  @ResponseMessage('Calculate sales contract totals')
  calculate(@Body() dto: CalculateSalesContractDto) {
    return this.salesContractsService.calculate(dto);
  }

  @Get()
  @ResponseMessage('Fetch list sales contracts with pagination')
  findAll(
    @Query('current') current: string,
    @Query('pageSize') pageSize: string,
    @Query() query: SalesContractListQuery,
  ) {
    return this.salesContractsService.findAll({
      ...query,
      current: +current,
      pageSize: +pageSize,
    });
  }

  @Public()
  @Get('signing/:token')
  @ResponseMessage('Fetch secure signing session')
  getSigningSession(@Param('token') token: string, @Req() req: RequestLike) {
    return this.salesContractsService.getSigningSession(
      token,
      getRequestMeta(req),
    );
  }

  @Public()
  @Post('signing/:token/otp')
  @ResponseMessage('Verify signing OTP')
  verifySigningOtp(
    @Param('token') token: string,
    @Body() dto: VerifySignatureOtpDto,
    @Req() req: RequestLike,
  ) {
    return this.salesContractsService.verifySignatureOtp(
      token,
      dto,
      getRequestMeta(req),
    );
  }

  @Public()
  @Post('signing/:token/sign')
  @ResponseMessage('Buyer signed sales contract')
  signFromInvitation(
    @Param('token') token: string,
    @Body() dto: PortalSignSalesContractDto,
    @Req() req: RequestLike,
  ) {
    return this.salesContractsService.signContractFromInvitation(
      token,
      dto,
      getRequestMeta(req),
    );
  }

  @Public()
  @Post('signing/:token/request-otp')
  @ResponseMessage('Request OTP for signing')
  requestSigningOtp(@Param('token') token: string, @Req() req: RequestLike) {
    return this.salesContractsService.requestSigningOtp(
      token,
      getRequestMeta(req),
    );
  }

  @Public()
  @Post('signing/:token/resend-otp')
  @ResponseMessage('Resend OTP to signer email')
  resendSigningOtp(@Param('token') token: string) {
    return this.salesContractsService.resendSigningOtpByToken(token);
  }

  @Get(':_id/signature-packet')
  @RequirePermissions('read:sales_contract')
  @ResponseMessage('Fetch sales contract signature audit packet')
  getSignaturePacket(@Param('_id') recordId: string) {
    return this.salesContractsService.getSignatureAuditPacket(recordId);
  }

  @Get(':_id/signature-packet.pdf')
  @RequirePermissions('read:sales_contract')
  async downloadSignaturePacketPdf(
    @Param('_id') recordId: string,
    @Res() res: Response,
  ) {
    const buffer =
      await this.salesContractsService.getSignatureAuditPacketPdf(recordId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="signature_packet_${recordId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':_id')
  @ResponseMessage('Fetch sales contract by recordId')
  findOne(@Param('_id') recordId: string) {
    return this.salesContractsService.findOne(recordId);
  }

  @Patch(':_id')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Update sales contract success')
  update(
    @Param('_id') recordId: string,
    @Body() updateDto: UpdateSalesContractDto,
  ) {
    return this.salesContractsService.update(recordId, updateDto);
  }

  @Patch(':_id/confirm')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Confirm sales contract and reserve stock')
  confirm(@Param('_id') recordId: string, @User() user: RequestUser) {
    return this.salesContractsService.confirmContract(recordId, user);
  }

  @Patch(':_id/submit-approval')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Submit sales contract for approval')
  submitApproval(@Param('_id') recordId: string, @User() user: RequestUser) {
    return this.salesContractsService.submitForApproval(recordId, user);
  }

  @Patch(':_id/send-signature')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Send sales contract for buyer signature')
  sendSignature(
    @Param('_id') recordId: string,
    @Body() dto: RequestSignatureInvitationDto,
    @User() user: RequestUser,
  ) {
    return this.salesContractsService.sendForSignature(recordId, dto, user);
  }

  @Patch(':_id/signature-invitations/resend')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Resend sales contract buyer signature invitation')
  resendSignature(@Param('_id') recordId: string, @User() user: RequestUser) {
    return this.salesContractsService.resendSignatureInvitation(recordId, user);
  }

  @Patch(':_id/signature-invitations/:invitation_id/revoke')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Revoke sales contract buyer signature invitation')
  revokeSignature(
    @Param('_id') recordId: string,
    @Param('invitation_id') invitationId: string,
    @Body() dto: RevokeSignatureInvitationDto,
    @User() user: RequestUser,
  ) {
    return this.salesContractsService.revokeSignatureInvitation(
      recordId,
      invitationId,
      dto,
      user,
    );
  }

  @Patch(':_id/cancel')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Submit sales contract cancellation for approval')
  cancel(
    @Param('_id') recordId: string,
    @Body() dto: RequestContractCancelDto,
    @User() user: RequestUser,
  ) {
    return this.salesContractsService.requestCancelContract(
      recordId,
      dto,
      user,
    );
  }

  @Post(':_id/signatures')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Sign sales contract success')
  sign(
    @Param('_id') recordId: string,
    @Body() dto: SignSalesContractDto,
    @User() user: RequestUser,
    @Req() req: RequestLike,
  ) {
    return this.salesContractsService.signContract(
      recordId,
      dto,
      user,
      getRequestMeta(req),
    );
  }

  @Patch(':_id/ship')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Ship sales contract items')
  ship(@Param('_id') recordId: string, @User() user: RequestUser) {
    return this.salesContractsService.shipContract(recordId, user);
  }
}
