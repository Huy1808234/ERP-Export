import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProductsService } from './products.service';

@Injectable()
export class ProductsListener {
  constructor(private readonly productsService: ProductsService) {}

  @OnEvent('shipment.on_board')
  async handleShipmentOnBoard(payload: any) {
    const { shipment } = payload;
    
    if (shipment.proformaInvoice && shipment.proformaInvoice.items) {
      for (const item of shipment.proformaInvoice.items) {
        // Deduct stock when shipment is ON_BOARD
        await this.productsService.deductStock(item.productId, item.quantity);
        console.log(`Deducted ${item.quantity} units for product ${item.productId} due to shipment ${shipment.shipmentNumber}`);
      }
    }
  }
}
