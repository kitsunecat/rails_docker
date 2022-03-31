create_table 'users', force: :cascade do |t|
  t.string 'name', default: '', null: false
  t.string 'email', default: '', null: false
  t.datetime 'updated_at', precision: 6, null: false
  t.datetime 'created_at', precision: 6, null: false
end
