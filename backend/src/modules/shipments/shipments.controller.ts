import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ShipmentsService, SHIPMENT_ROLES } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ResponseMessage, User, Roles, Public } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { ShipmentStatus } from './entities/shipment.entity';
import { CreateContainerDto } from './dto/create-container.dto';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  // ===========================================================================
  // SHIPMENT CRUD
  // ===========================================================================

  @Post()
  @Roles(...SHIPMENT_ROLES.CREATE)
  @ResponseMessage('Create shipment successfully')
  create(
    @Body() createShipmentDto: CreateShipmentDto,
    @User() user: UserEntity,
  ) {
    return this.shipmentsService.create(createShipmentDto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Fetch all shipments with pagination')
  findAll(@Query() query: any) {
    return this.shipmentsService.findAll(query);
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Fetch shipment statistics')
  getStats() {
    return this.shipmentsService.getStats();
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Fetch shipment by recordId')
  findOne(@Param('_id') recordId: string) {
    return this.shipmentsService.findOne(recordId);
  }

  @Patch(':_id')
  @Roles(...SHIPMENT_ROLES.UPDATE)
  @ResponseMessage('Update shipment successfully')
  update(
    @Param('_id') recordId: string,
    @Body() updateShipmentDto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(recordId, updateShipmentDto);
  }

  // ===========================================================================
  // STATUS MANAGEMENT
  // ===========================================================================

  @Patch(':_id/status')
  @Roles(...SHIPMENT_ROLES.STATUS)
  @ResponseMessage('Update shipment status')
  updateStatus(
    @Param('_id') recordId: string,
    @Body('status') status: ShipmentStatus,
    @User() user: UserEntity,
  ) {
    return this.shipmentsService.updateStatus(
      recordId,
      status,
      user.username,
    );
  }

  // ===========================================================================
  // STOCK & INVENTORY
  // ===========================================================================

  /**
   * Issue stock from warehouse for shipment.
   * Restricted to WAREHOUSE, LOGISTICS, ADMIN, and MANAGER roles.
   * This is a sensitive operation that triggers inventory deduction.
   */
  @Patch(':_id/issue-stock')
  @Roles(...SHIPMENT_ROLES.ISSUE_STOCK)
  @ResponseMessage('Xác nhận xuất kho thành công')
  issueStock(
    @Param('_id') recordId: string,
    @User() user: UserEntity,
  ) {
    return this.shipmentsService.issueStock(recordId, user);
  }

  // ===========================================================================
  // CONTAINER MANAGEMENT (Atomic Operations)
  // ===========================================================================

  /**
   * Add a single container to shipment.
   * Preferred over bulk array replacement to avoid race conditions.
   */
  @Post(':_id/containers')
  @Roles(...SHIPMENT_ROLES.UPDATE)
  @ResponseMessage('Add container to shipment')
  addContainer(
    @Param('_id') shipmentId: string,
    @Body() createContainerDto: CreateContainerDto,
    @User() user: UserEntity,
  ) {
    return this.shipmentsService.addContainer(
      shipmentId,
      createContainerDto,
      user.username,
    );
  }

  /**
   * Update a container in shipment.
   */
  @Patch(':_id/containers/:containerId')
  @Roles(...SHIPMENT_ROLES.UPDATE)
  @ResponseMessage('Update container in shipment')
  updateContainer(
    @Param('_id') shipmentId: string,
    @Param('containerId') containerId: string,
    @Body() containerData: Partial<CreateContainerDto>,
    @User() user: UserEntity,
  ) {
    return this.shipmentsService.updateContainer(
      shipmentId,
      containerId,
      containerData,
      user.username,
    );
  }

  /**
   * Remove a container from shipment.
   */
  @Delete(':_id/containers/:containerId')
  @Roles(...SHIPMENT_ROLES.UPDATE)
  @ResponseMessage('Remove container from shipment')
  removeContainer(
    @Param('_id') shipmentId: string,
    @Param('containerId') containerId: string,
    @User() user: UserEntity,
  ) {
    return this.shipmentsService.removeContainer(
      shipmentId,
      containerId,
      user.username,
    );
  }

  // ===========================================================================
  // DOCUMENT MANAGEMENT
  // ===========================================================================

  @Post(':_id/documents')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS')
  @ResponseMessage('Add document to shipment')
  addDocument(
    @Param('_id') shipmentId: string,
    @Body() data: any,
  ) {
    return this.shipmentsService.addDocument(shipmentId, data);
  }

  @Get(':_id/documents')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Get shipment documents')
  getDocuments(@Param('_id') shipmentId: string) {
    return this.shipmentsService.getDocuments(shipmentId);
  }

  // ===========================================================================
  // COMMERCIAL INVOICE
  // ===========================================================================

  @Get(':_id/commercial-invoice')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ResponseMessage('Get commercial invoice data')
  getCommercialInvoiceData(@Param('_id') recordId: string) {
    return this.shipmentsService.getCommercialInvoiceData(recordId);
  }

  // ===========================================================================
  // AUDIT TRAIL
  // ===========================================================================

  /**
   * Get audit trail for a shipment.
   * Shows all changes made to the shipment over time.
   */
  @Get(':_id/audit-trail')
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('Get shipment audit trail')
  getAuditTrail(@Param('_id') recordId: string) {
    return this.shipmentsService.getAuditTrail(recordId);
  }

  // ===========================================================================
  // PUBLIC TRACKING (Guest Access)
  // ===========================================================================

  /**
   * Public endpoint for shipment tracking.
   * SECURITY: Rate limiting should be applied at API gateway level.
   * This endpoint is intentionally public for customer convenience.
   */
  @Get('tracking/:number')
  @Public()
  @ResponseMessage('Tra cứu vận đơn thành công')
  tracking(@Param('number') number: string) {
    return this.shipmentsService.tracking(number);
  }
}
