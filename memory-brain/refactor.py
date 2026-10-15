import os
import sys
import autopep8


def refactor_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()
    
    # Apply autopep8 formatting
    formatted_code = autopep8.fix_code(code)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(formatted_code)
    print(f"Refactored {file_path}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python refactor.py <file_or_directory>")
        return

    target = sys.argv[1]
    if os.path.isfile(target):
        refactor_file(target)
    elif os.path.isdir(target):
        for root, _, files in os.walk(target):
            for file in files:
                if file.endswith('.py'):
                    refactor_file(os.path.join(root, file))
    else:
        print("Invalid path provided.")


if __name__ == "__main__":
    main()