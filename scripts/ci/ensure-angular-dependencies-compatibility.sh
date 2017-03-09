#!/bin/bash

###
# Copyright 2017 resin.io
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
###

set -u
set -e

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$HERE/../build/check-dependency.sh" jq

PACKAGE_JSON=package.json

declare -A MATCH_VERSIONS
MATCH_VERSIONS["dependencies[\"angular\"]"]="devDependencies[\"angular-mocks\"]"

function check_locked {
    name=$1
    version=$2
    if [[ "$version" =~ ^\^ ]]; then
        echo "Dependency: $name should be locked"
        exit 1
    fi
}

for primary in "${!MATCH_VERSIONS[@]}"; do
    primary_version=$(jq -r ".$primary" "$PACKAGE_JSON")
    check_locked "$primary" "$primary_version"
    secondary=${MATCH_VERSIONS[$primary]}
    secondary_version=$(jq -r ".$secondary" "$PACKAGE_JSON")
    check_locked "$secondary" "$secondary_version"
    if [[ "$primary_version" != "$secondary_version" ]]; then
        echo "The following dependencies should have the exact same version:"
        echo "    $primary"
        echo "    $secondary"
        exit 1
    fi
done
