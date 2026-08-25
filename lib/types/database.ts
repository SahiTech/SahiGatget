export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_provider_configurations: {
        Row: {
          api_url: string
          created_at: string
          enabled: boolean
          encrypted_api_key: string
          id: string
          model: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_url: string
          created_at?: string
          enabled?: boolean
          encrypted_api_key: string
          id?: string
          model: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_url?: string
          created_at?: string
          enabled?: boolean
          encrypted_api_key?: string
          id?: string
          model?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address: string
          area: string
          created_at: string
          customer_id: string
          district: string
          division: string
          id: string
          is_default: boolean
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address: string
          area: string
          created_at?: string
          customer_id: string
          district: string
          division: string
          id?: string
          is_default?: boolean
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          area?: string
          created_at?: string
          customer_id?: string
          district?: string
          division?: string
          id?: string
          is_default?: boolean
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      imei_inventory: {
        Row: {
          created_at: string
          id: string
          imei_1: string
          imei_2: string | null
          order_id: string | null
          serial_number: string | null
          sold_at: string | null
          status: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imei_1: string
          imei_2?: string | null
          order_id?: string | null
          serial_number?: string | null
          sold_at?: string | null
          status?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imei_1?: string
          imei_2?: string | null
          order_id?: string | null
          serial_number?: string | null
          sold_at?: string | null
          status?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_imei_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imei_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          compare_at_price_snapshot: number | null
          discount_amount: number
          id: string
          imei_2_snapshot: string | null
          imei_snapshot: string | null
          invoice_id: string
          line_total: number
          product_name_snapshot: string
          quantity: number
          serial_number_snapshot: string | null
          sku: string
          unit_price: number
          variant_title_snapshot: string
          warranty_policy_snapshot: string | null
        }
        Insert: {
          compare_at_price_snapshot?: number | null
          discount_amount?: number
          id?: string
          imei_2_snapshot?: string | null
          imei_snapshot?: string | null
          invoice_id: string
          line_total: number
          product_name_snapshot: string
          quantity: number
          serial_number_snapshot?: string | null
          sku: string
          unit_price: number
          variant_title_snapshot: string
          warranty_policy_snapshot?: string | null
        }
        Update: {
          compare_at_price_snapshot?: number | null
          discount_amount?: number
          id?: string
          imei_2_snapshot?: string | null
          imei_snapshot?: string | null
          invoice_id?: string
          line_total?: number
          product_name_snapshot?: string
          quantity?: number
          serial_number_snapshot?: string | null
          sku?: string
          unit_price?: number
          variant_title_snapshot?: string
          warranty_policy_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          customer_email_snapshot: string | null
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          delivery_charge: number
          discount_total: number
          grand_total: number
          id: string
          invoice_number: string
          issued_at: string
          order_id: string
          order_number_snapshot: string | null
          order_status_snapshot: string | null
          payment_method_snapshot: string | null
          payment_status_snapshot: string | null
          return_refund_policy_snapshot: string | null
          shipping_address_snapshot: string | null
          shipping_area_snapshot: string | null
          shipping_district_snapshot: string | null
          shipping_division_snapshot: string | null
          shipping_postal_code_snapshot: string | null
          store_profile_snapshot: Json | null
          subtotal: number
          warranty_policy_snapshot: string | null
        }
        Insert: {
          customer_email_snapshot?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          delivery_charge: number
          discount_total?: number
          grand_total: number
          id?: string
          invoice_number: string
          issued_at?: string
          order_id: string
          order_number_snapshot?: string | null
          order_status_snapshot?: string | null
          payment_method_snapshot?: string | null
          payment_status_snapshot?: string | null
          return_refund_policy_snapshot?: string | null
          shipping_address_snapshot?: string | null
          shipping_area_snapshot?: string | null
          shipping_district_snapshot?: string | null
          shipping_division_snapshot?: string | null
          shipping_postal_code_snapshot?: string | null
          store_profile_snapshot?: Json | null
          subtotal: number
          warranty_policy_snapshot?: string | null
        }
        Update: {
          customer_email_snapshot?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          delivery_charge?: number
          discount_total?: number
          grand_total?: number
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string
          order_number_snapshot?: string | null
          order_status_snapshot?: string | null
          payment_method_snapshot?: string | null
          payment_status_snapshot?: string | null
          return_refund_policy_snapshot?: string | null
          shipping_address_snapshot?: string | null
          shipping_area_snapshot?: string | null
          shipping_district_snapshot?: string | null
          shipping_division_snapshot?: string | null
          shipping_postal_code_snapshot?: string | null
          store_profile_snapshot?: Json | null
          subtotal?: number
          warranty_policy_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          compare_at_price_snapshot: number | null
          created_at: string
          discount_amount: number
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          sku: string
          unit_price: number
          variant_id: string | null
          variant_title_snapshot: string
          warranty_policy_snapshot: string | null
        }
        Insert: {
          compare_at_price_snapshot?: number | null
          created_at?: string
          discount_amount?: number
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          sku: string
          unit_price: number
          variant_id?: string | null
          variant_title_snapshot: string
          warranty_policy_snapshot?: string | null
        }
        Update: {
          compare_at_price_snapshot?: number | null
          created_at?: string
          discount_amount?: number
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          sku?: string
          unit_price?: number
          variant_id?: string | null
          variant_title_snapshot?: string
          warranty_policy_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          notes: string | null
          order_id: string
          previous_status: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          order_id: string
          previous_status?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          order_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          checkout_request_id: string | null
          created_at: string
          customer_email_snapshot: string | null
          customer_id: string
          customer_name_snapshot: string
          customer_phone_snapshot: string
          delivery_charge: number
          delivery_zone: string
          discount_total: number
          grand_total: number
          id: string
          notes: string | null
          order_number: string
          order_status: string
          payment_method: string
          payment_status: string
          shipping_address: string
          shipping_area: string
          shipping_district: string | null
          shipping_division: string | null
          shipping_postal_code: string | null
          subtotal: number
          tracking_token: string
          updated_at: string
        }
        Insert: {
          checkout_request_id?: string | null
          created_at?: string
          customer_email_snapshot?: string | null
          customer_id: string
          customer_name_snapshot: string
          customer_phone_snapshot: string
          delivery_charge: number
          delivery_zone: string
          discount_total?: number
          grand_total: number
          id?: string
          notes?: string | null
          order_number: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          shipping_address: string
          shipping_area: string
          shipping_district?: string | null
          shipping_division?: string | null
          shipping_postal_code?: string | null
          subtotal: number
          tracking_token: string
          updated_at?: string
        }
        Update: {
          checkout_request_id?: string | null
          created_at?: string
          customer_email_snapshot?: string | null
          customer_id?: string
          customer_name_snapshot?: string
          customer_phone_snapshot?: string
          delivery_charge?: number
          delivery_zone?: string
          discount_total?: number
          grand_total?: number
          id?: string
          notes?: string | null
          order_number?: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          shipping_address?: string
          shipping_area?: string
          shipping_district?: string | null
          shipping_division?: string | null
          shipping_postal_code?: string | null
          subtotal?: number
          tracking_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          compare_at_price: number | null
          created_at: string
          id: string
          is_active: boolean
          low_stock_threshold: number
          price: number
          product_id: string
          ram: string | null
          sku: string
          stock_quantity: number
          storage: string | null
          updated_at: string
          variant_title: string
        }
        Insert: {
          color?: string | null
          compare_at_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          price: number
          product_id: string
          ram?: string | null
          sku: string
          stock_quantity?: number
          storage?: string | null
          updated_at?: string
          variant_title: string
        }
        Update: {
          color?: string | null
          compare_at_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          price?: number
          product_id?: string
          ram?: string | null
          sku?: string
          stock_quantity?: number
          storage?: string | null
          updated_at?: string
          variant_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          product_type: string
          short_description: string | null
          slug: string
          status: string
          updated_at: string
          warranty_policy: string
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          product_type?: string
          short_description?: string | null
          slug: string
          status?: string
          updated_at?: string
          warranty_policy?: string
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          product_type?: string
          short_description?: string | null
          slug?: string
          status?: string
          updated_at?: string
          warranty_policy?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_support_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          order_number: string | null
          phone: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          order_number?: string | null
          phone: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          order_number?: string | null
          phone?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_support_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_products: {
        Row: {
          landing_page_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          landing_page_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          landing_page_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_products_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          hero_image_url: string | null
          id: string
          internal_name: string
          linked_product_id: string | null
          mobile_hero_image_url: string | null
          noindex: boolean
          og_image_url: string | null
          page_type: string
          published_at: string | null
          sections: Json
          slug: string
          seo_description: string | null
          seo_title: string | null
          starts_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          internal_name: string
          linked_product_id?: string | null
          mobile_hero_image_url?: string | null
          noindex?: boolean
          og_image_url?: string | null
          page_type?: string
          published_at?: string | null
          sections?: Json
          slug: string
          seo_description?: string | null
          seo_title?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          internal_name?: string
          linked_product_id?: string | null
          mobile_hero_image_url?: string | null
          noindex?: boolean
          og_image_url?: string | null
          page_type?: string
          published_at?: string | null
          sections?: Json
          slug?: string
          seo_description?: string | null
          seo_title?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          change_amount: number
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          reference_id: string | null
          variant_id: string
        }
        Insert: {
          change_amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          reference_id?: string | null
          variant_id: string
        }
        Update: {
          change_amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          reference_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      storefront_variants: {
        Row: {
          color: string | null
          compare_at_price: number | null
          id: string | null
          is_in_stock: boolean | null
          is_low_stock: boolean | null
          price: number | null
          product_id: string | null
          ram: string | null
          sku: string | null
          storage: string | null
          variant_title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_inventory: {
        Args: {
          p_actor_id: string
          p_change_amount: number
          p_movement_type: string
          p_notes: string
          p_variant_id: string
        }
        Returns: {
          new_stock_quantity: number
        }[]
      }
      create_guest_cod_order: {
        Args: {
          p_address: string
          p_area: string
          p_checkout_request_id: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_district: string
          p_division: string
          p_notes: string
          p_postal_code: string
          p_product_id: string
          p_quantity: number
          p_variant_id: string
        }
        Returns: {
          created_new: boolean
          order_id: string
          order_number: string
        }[]
      }
      ensure_invoice_for_order: {
        Args: { p_order_id: string }
        Returns: {
          invoice_id: string
          invoice_number: string
        }[]
      }
      update_admin_order_status: {
        Args: {
          p_actor_id: string
          p_new_status: string
          p_notes: string
          p_order_id: string
        }
        Returns: {
          order_status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
