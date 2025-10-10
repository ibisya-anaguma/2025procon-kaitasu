# gptに書かせたよ

# ==============================================================================
# 変数定義
# ==============================================================================

API_BASE_URL := http://localhost:3000
TOKEN_FILE := token.txt

# --- subscriptions 用 ---
SUBSCRIPTION_DATA := {"id":"010500000360004973360620491","quantity":4,"frequency":30}
SUBSCRIPTION_UPDATE_DATA := {"frequency":20}

# --- cart 用 ---
CART_DATA := {"id":"010500000360004973360620491","quantity":2}
CART_UPDATE_DATA := {"quantity":5}

FAVORITES_DATA := [{"id":"010500000360004973360620491"},{"id":"010500000360002000040030614"}]

JQ := $$(command -v jq >/dev/null 2>&1 && echo "jq ." || echo "cat")

CURL_AUTH = curl -fsS -H "Authorization: Bearer $$(cat $(TOKEN_FILE))"

# ==============================================================================
# ターゲット定義
# ==============================================================================

.PHONY: \
    post-subscriptions get-subscriptions patch-subscriptions delete-subscriptions \
    post-cart get-cart patch-cart delete-cart build-food-db \
    get-favorites post-favorites delete-favorites \
    get-recommendations get-history \
    get-budget-summary \
    search \
    get-user-information post-user-information patch-user-information


# ----------------------------------------------------------------------
# subscriptions 系
# ----------------------------------------------------------------------
post-subscriptions:
	@echo "--- POST /subscriptions ---"
	curl -fsS -X POST "$(API_BASE_URL)/api/subscriptions" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
		-H "Content-Type: application/json" \
		-d '$(SUBSCRIPTION_DATA)'
	@echo "\n--- done ---"

get-subscriptions:
	@echo "--- GET /subscriptions ---"
	curl -fsS -X GET "$(API_BASE_URL)/api/subscriptions" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))"
	@echo "\n--- done ---"

patch-subscriptions:
	@if [ -z "$(ID)" ]; then echo "例: make patch-subscriptions ID=xxxx"; exit 1; fi
	curl -fsS -X PATCH "$(API_BASE_URL)/api/subscriptions/$(ID)" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
		-H "Content-Type: application/json" \
		-d '$(SUBSCRIPTION_UPDATE_DATA)'
	@echo "\n--- done ---"

delete-subscriptions:
	@if [ -z "$(ID)" ]; then echo "例: make delete-subscriptions ID=xxxx"; exit 1; fi
	curl -fsS -X DELETE "$(API_BASE_URL)/api/subscriptions/$(ID)" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))"
	@echo "\n--- done ---"

# ----------------------------------------------------------------------
# cart 系
# ----------------------------------------------------------------------
post-cart:
	@echo "--- POST /cart ---"
	curl -fsS -X POST "$(API_BASE_URL)/api/cart" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
		-H "Content-Type: application/json" \
		-d '$(CART_DATA)'
	@echo "\n--- done ---"

get-cart:
	@echo "--- GET /cart ---"
	curl -fsS -X GET "$(API_BASE_URL)/api/cart" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))"
	@echo "\n--- done ---"

patch-cart:
	@if [ -z "$(ID)" ]; then echo "例: make patch-cart ID=xxxx"; exit 1; fi
	curl -fsS -X PATCH "$(API_BASE_URL)/api/cart/$(ID)" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
		-H "Content-Type: application/json" \
		-d '$(CART_UPDATE_DATA)'
	@echo "\n--- done ---"

delete-cart:
	@if [ -z "$(ID)" ]; then echo "例: make delete-cart ID=xxxx"; exit 1; fi
	curl -fsS -X DELETE "$(API_BASE_URL)/api/cart/$(ID)" \
		-H "Authorization: Bearer $$(cat $(TOKEN_FILE))"
	@echo "\n--- done ---"


# ================= favorites 用 =================


# GET /api/favorites
get-favorites:
	@echo "--- GET /favorites ---"
	@curl -sS -X GET "$(API_BASE_URL)/api/favorites" \
	  -H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
	| (command -v jq >/dev/null 2>&1 && jq . || cat)
	@echo "\n--- done ---"

# POST /api/favorites    (配列を送る想定)
post-favorites:
	@echo "--- POST /favorites ---"
	@curl -sS -X POST "$(API_BASE_URL)/api/favorites" \
	  -H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
	  -H "Content-Type: application/json" \
	  --data-binary '$(FAVORITES_DATA)' \
	| (command -v jq >/dev/null 2>&1 && jq . || cat)
	@echo "\n--- done ---"

# DELETE /api/favorites/:id    例: make delete-favorites ID=0105...
delete-favorites:
	@if [ -z "$(ID)" ]; then echo "例: make delete-favorites ID=010500000360004973360620491"; exit 1; fi
	@echo "--- DELETE /favorites/$(ID) ---"
	@curl -sS -X DELETE "$(API_BASE_URL)/api/favorites/$(ID)" \
	  -H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
	| (command -v jq >/dev/null 2>&1 && jq . || cat)
	@echo "\n--- done ---"


# ================= recommendations 用 =================

# GET /api/recommendations
get-recommendations:
	@echo "--- GET /recommendations ---"
	@curl -sS -X GET "$(API_BASE_URL)/api/recommendations" \
	  -H "Authorization: Bearer $$(cat $(TOKEN_FILE))" \
	| (command -v jq >/dev/null 2>&1 && jq . || cat)
	@echo "\n--- done ---"

# ================= history 用 =================

# GET /api/history
get-history:
	@echo "--- GET /history ---"
	@$(CURL_AUTH) -X GET "$(API_BASE_URL)/api/history" | $(JQ);
	@echo "\n--- done ---"


# ================= budget-summary 用 =================

# GET /api/budget/summary
get-budget-summary:
	@echo "--- GET /budget/summary ---"
	@$(CURL_AUTH) -X GET "$(API_BASE_URL)/api/budget-summary" | $(JQ);
	@echo "\n--- done ---"


# ================= search 用 =================

# デフォルト値（必要に応じて上書きして使う）
SEARCH_Q ?= "かいわれ"
SEARCH_GENRE ?= null
SEARCH_FAVORITE ?= false
SEARCH_UID ?=
SEARCH_LIMIT ?= 50

# POST /api/search 例:
#    make search SEARCH_Q="牛乳 低脂肪" SEARCH_GENRE=100 SEARCH_FAVORITE=true SEARCH_UID=dev-user SEARCH_LIMIT=30
search:
	@echo "--- POST /search ---"
	@curl -sS -X POST "$(API_BASE_URL)/api/search" \
	  -H "Content-Type: application/json" \
	  --data-binary "{\"q\":\"$(SEARCH_Q)\",\"genre\":$(SEARCH_GENRE),\"favorite\":$(SEARCH_FAVORITE),\"uid\":\"$(SEARCH_UID)\",\"limit\":$(SEARCH_LIMIT)}" \
	| $(JQ)
	@echo "\n--- done ---"


# ================= user-information 用 =================

# デフォルトの送信データ（必要なら上書きしてください）
UI_PATCH_DATA ?= {"name":"テスト太郎","monthlyBudget":20000,"resetDay":25}
UI_POST_DATA  ?= {"disease":["Hypertension"],"increaseNutrients":["Protein"],"reduceNutrients":["Salt"]}

# GET /api/user-information
get-user-information:
	@echo "--- GET /user-information ---"
	@$(CURL_AUTH) -X GET "$(API_BASE_URL)/api/user-information" | $(JQ)
	@echo "\n--- done ---"

# PATCH /api/user-information
patch-user-information:
	@echo "--- PATCH /user-information ---"
	@$(CURL_AUTH) -X PATCH "$(API_BASE_URL)/api/user-information" \
		-H "Content-Type: application/json" \
		--data-binary '$(UI_PATCH_DATA)' | $(JQ)
	@echo "\n--- done ---"

# POST /api/user-information
post-user-information:
	@echo "--- POST /user-information ---"
	@$(CURL_AUTH) -X POST "$(API_BASE_URL)/api/user-information" \
		-H "Content-Type: application/json" \
		--data-binary '$(UI_POST_DATA)' | $(JQ)
	@echo "\n--- done ---"
