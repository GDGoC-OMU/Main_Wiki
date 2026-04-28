.PHONY: build

build:
	docker compose run --rm antora generate path.yml
	@echo "Build complete. Check the output in the 'build' directory."

deploy:
	rsync -avz ./build/site/ Muu:/home/users/2/muu-da08a5be44/web/gdgoc-omu.jp/manual/
	@echo "Deploy complete. Check the output in the 'build' directory."