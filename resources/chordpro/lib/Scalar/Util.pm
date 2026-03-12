#line 1 "<embedded>/Scalar/Util.pm"
# Copyright (c) 1997-2007 Graham Barr <gbarr@pobox.com>. All rights reserved.
# This program is free software; you can redistribute it and/or
# modify it under the same terms as Perl itself.
#
# Maintained since 2013 by Paul Evans <leonerd@leonerd.org.uk>

package Scalar::Util;

use strict;
use warnings;
require Exporter;

our @ISA       = qw(Exporter);
our @EXPORT_OK = qw(
  blessed refaddr reftype weaken unweaken isweak

  dualvar isdual isvstring looks_like_number openhandle readonly set_prototype
  tainted
);
our $VERSION    = "1.69";
$VERSION =~ tr/_//d;

require List::Util; # List::Util loads the XS
List::Util->VERSION( $VERSION ); # Ensure we got the right XS version (RT#100863)

if( $] >= 5.040 ) {
  # On Perl 5.40 and above, these builtins are stable, so we can use them
  # instead of our own XS implementation

  # Using this instead of a globref means we don't create an empty
  # "builtins::" glob on older perls
  no strict 'refs';
  my $builtins = \%{"builtin::"};

  *$_ = \&{ $builtins->{$_} } for (qw( blessed refaddr reftype weaken unweaken ));
  *isweak = \&{ $builtins->{is_weak} };  # renamed
}

# set_prototype has been moved to Sub::Util with a different interface
sub set_prototype(&$)
{
  my ( $code, $proto ) = @_;
  return Sub::Util::set_prototype( $proto, $code );
}

1;

__END__

#line 86

#line 381
