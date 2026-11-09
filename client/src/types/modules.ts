export type ProjectModuleRow = {
  id: string;
  project_id: string;
  module_type: string;
  title: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  input_json: any | null;
  output_json: any | null;
  created_at: string;
  updated_at: string | null;
};
