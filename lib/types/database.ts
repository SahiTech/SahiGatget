export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          description: string | null
          is_active: boolean
          meta_title: string | null
          meta_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          description?: string | null
          is_active?: boolean
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          description?: string | null
          is_active?: boolean
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          image_url: string | null
          sort_order: number
          is_active: boolean
          meta_title: string | null
          meta_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          brand_id: string | null
          category_id: string | null
          name: string
          slug: string
          short_description: string | null
          description: string | null
          product_type: string
          status: string
          is_featured: boolean
          is_published: boolean
          warranty_policy: string
          meta_title: string | null
          meta_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id?: string | null
          category_id?: string | null
          name: string
          slug: string
          short_description?: string | null
          description?: string | null
          product_type?: string
          status?: string
          is_featured?: boolean
          is_published?: boolean
          warranty_policy?: string
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string | null
          category_id?: string | null
          name?: string
          slug?: string
          short_description?: string | null
          description?: string | null
          product_type?: string
          status?: string
          is_featured?: boolean
          is_published?: boolean
          warranty_policy?: string
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          sku: string
          variant_title: string
          ram: string | null
          storage: string | null
          color: string | null
          price: number
          compare_at_price: number | null
          stock_quantity: number
          low_stock_threshold: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          sku: string
          variant_title: string
          ram?: string | null
          storage?: string | null
          color?: string | null
          price: number
          compare_at_price?: number | null
          stock_quantity?: number
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          sku?: string
          variant_title?: string
          ram?: string | null
          storage?: string | null
          color?: string | null
          price?: number
          compare_at_price?: number | null
          stock_quantity?: number
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      stock_movements: {
        Row: {
          id: string
          variant_id: string
          change_amount: number
          movement_type: string
          reference_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          change_amount: number
          movement_type: string
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          change_amount?: number
          movement_type?: string
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      imei_inventory: {
        Row: {
          id: string
          variant_id: string
          imei_1: string
          imei_2: string | null
          serial_number: string | null
          status: string
          order_id: string | null
          sold_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          imei_1: string
          imei_2?: string | null
          serial_number?: string | null
          status?: string
          order_id?: string | null
          sold_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          imei_1?: string
          imei_2?: string | null
          serial_number?: string | null
          status?: string
          order_id?: string | null
          sold_at?: string | null
          created_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          user_id: string | null
          full_name: string
          phone: string
          email: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          full_name: string
          phone: string
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          full_name?: string
          phone?: string
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customer_addresses: {
        Row: {
          id: string
          customer_id: string
          division: string
          district: string
          area: string
          address: string
          postal_code: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          division: string
          district: string
          area: string
          address: string
          postal_code?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          division?: string
          district?: string
          area?: string
          address?: string
          postal_code?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      admin_users: {
        Row: {
          id: string
          user_id: string
          full_name: string
          email: string
          role: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          email: string
          role?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          email?: string
          role?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_id: string
          subtotal: number
          discount_total: number
          delivery_charge: number
          grand_total: number
          payment_method: string
          payment_status: string
          order_status: string
          delivery_zone: string
          shipping_address: string
          shipping_area: string
          customer_name_snapshot: string
          customer_phone_snapshot: string
          notes: string | null
          tracking_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          customer_id: string
          subtotal: number
          discount_total?: number
          delivery_charge: number
          grand_total: number
          payment_method?: string
          payment_status?: string
          order_status?: string
          delivery_zone: string
          shipping_address: string
          shipping_area: string
          customer_name_snapshot: string
          customer_phone_snapshot: string
          notes?: string | null
          tracking_token: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          customer_id?: string
          subtotal?: number
          discount_total?: number
          delivery_charge?: number
          grand_total?: number
          payment_method?: string
          payment_status?: string
          order_status?: string
          delivery_zone?: string
          shipping_address?: string
          shipping_area?: string
          customer_name_snapshot?: string
          customer_phone_snapshot?: string
          notes?: string | null
          tracking_token?: string
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          variant_id: string | null
          sku: string
          product_name_snapshot: string
          variant_title_snapshot: string
          unit_price: number
          quantity: number
          line_total: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          variant_id?: string | null
          sku: string
          product_name_snapshot: string
          variant_title_snapshot: string
          unit_price: number
          quantity: number
          line_total: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          variant_id?: string | null
          sku?: string
          product_name_snapshot?: string
          variant_title_snapshot?: string
          unit_price?: number
          quantity?: number
          line_total?: number
          created_at?: string
        }
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          previous_status: string | null
          new_status: string
          notes: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          previous_status?: string | null
          new_status: string
          notes?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          previous_status?: string | null
          new_status?: string
          notes?: string | null
          changed_by?: string | null
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          order_id: string
          subtotal: number
          discount_total: number
          delivery_charge: number
          grand_total: number
          issued_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          order_id: string
          subtotal: number
          discount_total?: number
          delivery_charge: number
          grand_total: number
          issued_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          order_id?: string
          subtotal?: number
          discount_total?: number
          delivery_charge?: number
          grand_total?: number
          issued_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          sku: string
          product_name_snapshot: string
          variant_title_snapshot: string
          imei_snapshot: string | null
          unit_price: number
          quantity: number
          line_total: number
        }
        Insert: {
          id?: string
          invoice_id: string
          sku: string
          product_name_snapshot: string
          variant_title_snapshot: string
          imei_snapshot?: string | null
          unit_price: number
          quantity: number
          line_total: number
        }
        Update: {
          id?: string
          invoice_id?: string
          sku?: string
          product_name_snapshot?: string
          variant_title_snapshot?: string
          imei_snapshot?: string | null
          unit_price?: number
          quantity?: number
          line_total?: number
        }
      }
      settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          details?: Json | null
          created_at?: string
        }
      }
    }
  }
}
