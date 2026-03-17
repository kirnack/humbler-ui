Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "home#index"

  namespace :api do
    get  "status",   to: "status#show"
    post "auth",     to: "auth#create"
    get  "bundles",  to: "bundles#index"
    post "download", to: "downloads#create"
    get  "download/status/:task_id", to: "downloads#show", as: :download_status
  end
end
