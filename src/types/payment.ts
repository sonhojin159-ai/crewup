export interface BootpayConfirmResponse {
  receipt_id: string;
  order_id: string;
  price: number;
  tax_free: number;
  cancelled_price: number;
  cancelled_tax_free: number;
  order_name: string;
  company_name: string;
  gateway_url: string;
  metadata: any;
  sandbox: boolean;
  pg: string;
  method: string;
  method_symbol: string;
  method_origin: string;
  method_origin_symbol: string;
  purchased_at: string;
  cancelled_at: string;
  revoked_at: string;
  status: number;
  status_en: string;
  status_ko: string;
  card_data: any;
  bank_data: any;
  vbank_data: any;
  receipt_url: string;
  cash_receipt_data: any;
}

export interface VerifyPaymentRequest {
  receiptId: string;
  orderId: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  data?: BootpayConfirmResponse;
  error?: string;
}
