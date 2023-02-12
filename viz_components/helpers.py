from random import getrandbits
# misc helpers for viz components


def unique_id(prefix):
    return prefix + str(getrandbits(40))
