#!/bin/bash

N="$1"
[ -z "${N}" ] && N="I'm a test script!"

cat <<END >&1
${N}
this line should not be displayed
END

cat <<END >&2
${N}
this line should be displayed
END

exit 0
