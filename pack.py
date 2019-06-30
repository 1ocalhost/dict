#!/usr/bin/env python3
import os
import re
import zipfile
import json
import datetime


'''
Supported rules:
R: match in root only
A: match all by name

R: [/][path/]folder[*]/[*]
R: [/][path/]file[*]
A: file[*]
'''


class ExcludeRuleItem:
    def __init__(self, value, full_path, is_folder):
        def make_re():
            return re.escape(value).replace(r'\*', r'[^/\\]+')

        self.value = value
        self.full_path = full_path

        if (is_folder):
            self.wildcard = True
            self.re_value = make_re() + '(/.+)?'
        else:
            self.wildcard = '*' in value
            self.re_value = None
            if self.wildcard:
                self.re_value = make_re()

        if self.re_value:
            self.re_value = "^" + self.re_value + "$"

    def match_file(self, value):
        if not self.wildcard:
            return self.value == value
        return re.match(self.re_value, value)

    def match_dir(self, path):
        path = path.replace('\\', '/')
        return re.match(self.re_value, path)


class ExcludeFile:
    def __init__(self):
        self.dir_rules = []
        self.file_rules = []

    def add_dir_rule(self, value, full_path):
        item = ExcludeRuleItem(value, full_path, True)
        self.dir_rules.append(item)

    def add_file_rule(self, value, full_path):
        item = ExcludeRuleItem(value, full_path, False)
        self.file_rules.append(item)

    def load_rules(self, file_path):
        with open(file_path, "r") as ins:
            for line in ins:
                line = line.rstrip()
                if not line:
                    continue

                if line[0] == '!':
                    continue

                self.parse_add_rule(line)

    def parse_add_rule(self, rule):
        is_folder = False
        match_all = False

        if rule.startswith('**'):
            raise Exception('not support yet')

        if rule[-1] == '*':
            if rule[-2] == '/':
                rule = rule[:-2]
                is_folder = True
        elif rule[-1] == '/':
            rule = rule[:-1]
            is_folder = True

        if (not is_folder) and ('/' not in rule):
            match_all = True

        if rule[0] == '/':
            rule = rule[1:]

        full_path = not match_all
        if is_folder:
            self.add_dir_rule(rule, full_path)
        else:
            self.add_file_rule(rule, full_path)

    def match_dir(self, path):
        if not path:
            return False

        for r in self.dir_rules:
            if r.full_path:
                if r.match_dir(path):
                    return True
            else:
                assert False
        return False

    def match_file(self, dir_path, file_name):
        for r in self.file_rules:
            if r.full_path:
                if r.match_file(os.path.join(dir_path, file_name)):
                    return True
            else:
                if r.match_file(file_name):
                    return True
        return False


def set_work_dir_as_script():
    abspath = os.path.abspath(__file__)
    dname = os.path.dirname(abspath)
    os.chdir(dname)


def zipdir(path, zf, self_name, exclude):
    def relative_path(root):
        if root == path:
            return ''

        pre_len = len(path)
        if root[pre_len] in '/\\':
            pre_len += 1
        return root[pre_len:]

    for root, dirs, files in os.walk(path, topdown=True):
        if root == path:
            try:
                files.remove(self_name)
            except ValueError:
                pass

        rel_path = relative_path(root)
        if exclude.match_dir(rel_path):
            continue

        for file in files:
            if exclude.match_file(rel_path, file):
                continue

            print(os.path.join(root, file))
            zf.write(os.path.join(root, file))


def pack_dir(pack_name, exclude):
    exclude.add_file_rule(pack_name, True)
    zf = zipfile.ZipFile(pack_name, 'w', zipfile.ZIP_DEFLATED)
    zipdir('.', zf, pack_name, exclude)
    zf.close()


def check_version():
    today = datetime.date.today()
    today_ver = today.strftime('.%y.%m%d.')
    manifest_ver = ''

    with open('manifest.json', encoding='utf-8') as json_file:
        data = json.load(json_file)
        manifest_ver = data['version']

    if today_ver in manifest_ver:
        return True

    print(f'manifest: {manifest_ver}  (expected: *{today_ver}*)')
    answer = input("Continue? [y/n]")
    if answer.lower() == 'y':
        return True

    return False


def main():
    set_work_dir_as_script()

    if not check_version():
        print('aborted')
        return

    exclude = ExcludeFile()
    exclude.load_rules('.gitignore')
    exclude.load_rules('.pkgignore')
    exclude.add_file_rule(os.path.basename(__file__), True)
    pack_dir('pack.zip', exclude)

if __name__ == '__main__':
    main()
